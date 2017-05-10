const gm = require('gm');
const path = require('path');
const uuid = require('uuid/v4');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const MEDIATOR_FUNCTION_NAME = 'mediator';
const S3_OUTPUT_BUCKET = 'aeris-osn-2017';
const S3_OUTPUT_PREFIX = '/gif-creator';

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

		// @todo I think we have to download each image, can't do just streams

		// Save back to S3
		const outputLocation = {
			bucket: S3_OUTPUT_BUCKET,
			// @todo change key
			key: `${S3_OUTPUT_PREFIX}/${payload.imageId}/${payload.width}x${payload.height}/${uuid()}${path.basename(srcImageLocation.key)}`
		};
		await new Promise((resolve, reject) => {
			const s3Params = {
				Bucket: outputLocation.bucket,
				Key: outputLocation.key,
				Body: thumbnailReadStream
			};
			console.log(`Sending to S3 ${JSON.stringify(outputLocation)} ...`);
			s3.upload(s3Params, function(err, metadata) {
				if(err) return reject(err);
				console.log("Done sending to S3.");
				return resolve(metadata);
			});
		});

		const resultMessage = {
			type: 'did-create-thumbnail',
			payload: {
				imageId: event.payload.imageId,
				validTime: event.payload.imageId,
				location: outputLocation
			}
		};

		// Send the result back to the mediator
		console.log("Sending message to the mediator...");
		lambda.invoke({
				FunctionName:   MEDIATOR_FUNCTION_NAME,
				Qualifier:      '$LATEST',
				InvocationType: 'Event',
				Payload:        [resultMessage]
			},
			function (err, result) {
				if(err) return callback(err);
				// Successfully sent result to the mediator!
				callback(resultMessage);
			});
	}
	catch (error) {
		callback(error);
	}
};