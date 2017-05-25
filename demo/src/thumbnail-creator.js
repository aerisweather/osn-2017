const path = require('path');
const uuid = require('uuid/v4');
const sharp = require('sharp');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const lambda = new Lambda();
const s3 = new S3();

/**
 * Payload:
 * {
 * 	 imageId: string;
 * 	 location: { Bucket: string; Key: string; };
 * 	 height: number;
 * 	 width: number;
 * 	 validTime: Date 		// ISO string
 * }
 */
exports.handler = async function (event, context, callback) {
	try {
		console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

		// Download from S3
		const payload = event.payload;
		const srcImageLocation = payload.location;
		const s3ReadStream = s3.getObject(payload.location)
			.createReadStream()
			.on('error', callback);

		// Convert to thumbnail
		const thumbnailReadStream = s3ReadStream
			.pipe(sharp().resize(200, 200).png());

		// Save back to S3
		const uploadLocation = {
			Bucket: 'aeris-osn-2017',
			Key: [
				`thumbnail-creator`,
				`/${payload.imageId}`,
				`/${payload.width}x${payload.height}`,
				`/${uuid()}`,
				path.basename(srcImageLocation.Key)
			].join('')
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: thumbnailReadStream
		}).promise();

		const outMessages = [{
			type: 'did-create-thumbnail',
			payload: {
				imageId: payload.imageId,
				validTime: payload.validTime,
				location: uploadLocation
			}
		}];

		// Send a message to the mediator,
		// to let it know we're done
		await lambda.invoke({
			FunctionName: 'mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessages)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);

		callback(null, outMessages);
	}
	catch (error) {
		callback(error);
	}
};