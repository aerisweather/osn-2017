const fs = require('fs');
const gm = require('gm');
const path = require('path');
const uuid = require('uuid/v4');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const lambda = new Lambda();
const s3 = new S3();

exports.handler = async function (event, context, callback) {
	try {
		console.log(`Received event: ${JSON.stringify(event, null, 2)}`);
		const payload = event.payload;

		// Download all images to /tmp/[i].png
		const imgPaths = await Promise.all(
			payload.locations.map(
				(s3Loc, i) => new Promise((onRes) => {
					s3.getObject(s3Loc)
						.createReadStream()
						.pipe(fs.createWriteStream(`/tmp/${i}`))
						.on('finish', () => onRes(`/tmp/${i}`))
				})
			)
		);

		// Create a GIF from the images
		// See https://github.com/aheckmann/gm/issues/82#issuecomment-225227703
		const gmInstance = gm();
		for (let path of imgPaths) {
			gmInstance.in(path);
		}
		await new Promise((onRes, onErr) => {
			gmInstance
				.delay(500)
				.write('/tmp/animated.gif', err => err ? onErr(err) : onRes())
		});
		const gifReadStream = fs.createReadStream('/tmp/animated.gif');

		// Save back to S3
		const uploadLocation = {
			Bucket: 'aeris-osn-2017',
			Key: [
				`gif-creator`,
				`/${payload.imageId}`,
				`/${uuid()}`,
				`${path.basename(payload.location.Key)}`
			]
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: gifReadStream
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessages = [{
			type: 'did-create-thumbnail',
			payload: {
				imageId: payload.imageId,
				validTime: payload.validTime,
				location: uploadLocation
			}
		}];
		lambda.invoke({
			FunctionName: 'mediator',
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