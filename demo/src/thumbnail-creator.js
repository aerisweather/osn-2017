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
exports.handler = async function (message, context, callback) {
	try {
		context.callbackWaitsForEmptyEventLoop = false;
		console.log(`Received event: ${JSON.stringify(message, null, 2)}`);

		// Download from S3
		const srcImageLocation = message.location;
		const s3ReadStream = s3.getObject(message.location)
			.createReadStream()
			.on('error', callback);

		// Convert to thumbnail
		const thumbnailReadStream = s3ReadStream
			.pipe(sharp().resize(200, 200).png());

		// Save back to S3
		const uploadLocation = {
			Bucket: process.env.S3_BUCKET,
			Key: [
				`thumbnail-creator`,
				`/${message.imageId}`,
				`/${message.width}x${message.height}`,
				`/${message.validTime}`,
				`/${uuid()}`,
				path.basename(srcImageLocation.Key)
			].join('')
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: thumbnailReadStream,
			ACL: 'public-read'
		}).promise();

		const outMessage = {
			type: 'did-create-thumbnail',
			dateCreated: Date.now(),
			imageId: message.imageId,
			validTime: message.validTime,
			location: uploadLocation
		};

		// Send a message to the mediator,
		// to let it know we're done
		await lambda.invoke({
			FunctionName: 'osn2017-mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessage)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessage, null, 2)}`);

		callback(null, outMessage);
	}
	catch (error) {
		callback(error);
	}
};