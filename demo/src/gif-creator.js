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
 * 	 validTime: number;  // UNIX timestamp
 * 	 gifDelay: number;	 // delay between frames in ms
 * 	 gifLoop: Boolean;
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
		// using ImageMagick
		execSync([
			'convert',
			// Delay between animation frames (in centiseconds)
			`-delay ${message.gifDelay / 10}`,
			// How often to loop the animation ("0" === "infinite")
			`-loop ${message.gifLoop ? '0' : '1'}`,
			// Source images
			imgPaths.join(' '),
			// Destination GIF
			'/tmp/animated.gif'
		].join(''));

		// Save back to S3
		const uploadLocation = {
			Bucket: process.env.S3_BUCKET,
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
			Body: fs.createReadStream('/tmp/animated.gif'),
			ACL: 'public-read'
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessage = {
			type: 'did-create-gif',
			dateCreated: Date.now(),
			imageId: message.imageId,
			validTime: message.validTime,
			location: uploadLocation
		};
		await lambda.invoke({
			FunctionName: 'osn2017-mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessage)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessage, null, 2)}`);

		callback(null, outMessage);
	}
	catch (error) {
		callback(error)
	}
};