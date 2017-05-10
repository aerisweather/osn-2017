const gm = require('gm');
const path = require('path');
const uuid = require('uuid/v4');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const MEDIATOR_FUNCTION_NAME = 'mediator';
const S3_OUTPUT_BUCKET = 'aeris-osn-2017';
const S3_OUTPUT_PREFIX = '/thumbnail-generator';

const lambda = new Lambda();
const s3 = new S3();

exports.handler = async function (event, context, callback) {

	try {
		console.log(`Got event: `, event);

		// Download from S3
		const srcImageLocation = event.payload.location;
		console.log(`Creating stream from: ${JSON.stringify(srcImageLocation)}`)
		const s3ReadStream = s3.getObject(srcImageLocation).createReadStream()
			.on('error', callback);

		// Get conversion stream
		const thumbnailReadStream = getThumbnailStream({
			inputStream: s3ReadStream,
			width: event.payload.width,
			height: event.payload.height
		})
			.on('error', callback);

		// Save back to S3
		const config = event.payload;
		const outputLocation = {
			bucket: S3_OUTPUT_BUCKET,
			key: `${S3_OUTPUT_PREFIX}/${config.imageId}/${config.width}x${config.height}/${uuid()}${path.basename(config.location.key)}`
		};
		await new Promise((resolve, reject) => {
			const s3Params = {
				Bucket: outputLocation.bucket,
				Key: outputLocation.key,
				Body: thumbnailReadStream
			};
			s3.upload(s3Params, function(err, metadata) {
				if(err) return reject(err);
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

/**
 * @param {{inputStream:stream.Readable, width:number, height:number}}options
 * @return stream.Readable
 */
function getThumbnailStream(options) {
	return gm(options.inputStream)
			.resize(options.width, options.height)
			.stream();
}