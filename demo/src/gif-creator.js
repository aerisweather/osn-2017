const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;
const execSync = require('child_process').execSync;

const lambda = new Lambda();
const s3 = new S3();

/**
 * Payload:
 * {
 * 	 imageId: string;
 * 	 locations: { Bucket: string; Key: string; }[];
 * 	 validTime: Date;  // ISO string
 * }
 */
exports.handler = async function (message, context, callback) {
	try {
		context.callbackWaitsForEmptyEventLoop = false;
		console.log(`Received event: ${JSON.stringify(message, null, 2)}`);

		// Download all images to /tmp/[i].png
		const imgPaths = await Promise.all(
			message.locations.map(
				(s3Loc, i) => new Promise((onRes) => {
					s3.getObject(s3Loc)
						.createReadStream()
						.pipe(fs.createWriteStream(`/tmp/${i}.png`))
						.on('finish', () => onRes(`/tmp/${i}.png`))
				})
			)
		);

		// Create a GIF from the images
		execSync(`convert -delay 20 -loop 0 ${imgPaths.join(' ')} /tmp/animated.gif`);

		// Save back to S3
		const uploadLocation = {
			Bucket: 'aeris-osn-2017',
			Key: [
				`gif-creator`,
				`/${message.imageId}`,
        `/${message.validTime}`,
				`/${uuid()}.gif`
			].join('')
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: fs.createReadStream('/tmp/animated.gif')
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessages = [{
			type: 'did-create-gif',
			dateCreated: Date.now(),
			imageId: message.imageId,
			validTime: message.validTime,
			location: uploadLocation
		}];
		lambda.invoke({
			FunctionName: 'osn2017-mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessages)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);

		callback(null, outMessages);
	}
	catch (error) {
		callback(error)
	}
};