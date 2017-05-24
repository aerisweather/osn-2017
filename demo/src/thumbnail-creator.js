const gm = require('gm');
const path = require('path');
const uuid = require('uuid/v4');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const lambda = new Lambda();
const s3 = new S3();

exports.handler = async function (event, context, callback) {
	try {
		console.log(`Got event: `, event);
		const payload = event.payload;

		// Download from S3
		const srcImageLocation = payload.location;
		console.log(`Creating stream from: ${JSON.stringify(srcImageLocation)}`);
		const s3ReadStream = s3.getObject(srcImageLocation).createReadStream()
			.on('error', callback);

		// Get conversion stream
		const thumbnailReadStream = gm(s3ReadStream)
			.resize(payload.width, payload.height)
			.stream()
			.on('error', callback);

		// Save back to S3
		const outputLocation = {
			bucket: 'aeris-osn-2017',
			key: `/thumbnail-generator/${payload.imageId}/${payload.width}x${payload.height}/${uuid()}${path.basename(srcImageLocation.key)}`
		};
		await s3.upload({
      Bucket: outputLocation.bucket,
      Key: outputLocation.key,
      Body: thumbnailReadStream
    }).promise();

		const outMessages = [{
			type: 'did-create-thumbnail',
			payload: {
				imageId: event.payload.imageId,
				validTime: event.payload.imageId,
				location: outputLocation
			}
		}];

		// Send a message to the mediator,
		// to let it know we're done
		await lambda.invoke({
      FunctionName:   'mediator',
      InvocationType: 'Event',
      Payload:        JSON.stringify(outMessages)
    }).promise();
		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);

		callback(null, outMessages);
	}
	catch (error) {
		callback(error);
	}
};