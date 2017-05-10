const crypto = require('crypto');
const fs = require('fs');
const gm = require('gm');
const path = require('path');

const Lambda = require('aws-sdk').Lambda;
const S3 = require('aws-sdk').S3;

const MEDIATOR_FUNCTION_NAME = 'mediator';
const S3_OUTPUT_BUCKET = 'aeris-osn-2017';
const S3_OUTPUT_PREFIX = '/thumbnail-generator';

const lambda = new Lambda();
const s3 = new S3();

exports.handler = async function (event, context, callback) {
	let tmpPath;
	let thumbnailPath;

	function errorHandler(error) {
		// We had an error somewhere we didn't expect...
		if(tmpPath) {
			// Remove our temporary file, if we had one
			fs.unlinkSync(tmpPath);
		}
		callback(error);
	}

	try {
		console.log(`Got event: `, event);
		tmpPath = getTmpPath(event);

		// Download from S3
		fs.createWriteStream(tmpPath);
		s3.getObject(event.location).createReadStream()
			.on('error', errorHandler)
			.pipe(file)
			.on('error', errorHandler);

		// Convert Image
		thumbnailPath = getTmpPath(event, '.thumb');
		await createThumbnail({
			inputPath: tmpPath,
			outputPath: thumbnailPath,
			width: event.payload.width,
			height: event.payload.height
		});

		// Save back to S3
		const outputLocation = {
			Bucket: S3_OUTPUT_BUCKET,
			Key: `${S3_OUTPUT_PREFIX}/${path.basename(thumbnailPath)}`
		};
		const thumbnailReadStream = fs.createReadStream(thumbnailPath);
		await new Promise((resolve, reject) => {
			const s3Params = {
				...outputLocation,
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
				location: {
					bucket: outputLocation.Bucket,
					key: outputLocation.Key
				}
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
				// Called lambda function, all done!
				callback(null, true);
			});
	}
	catch (error) {
		errorHandler(error);
	}
};

function getTmpPath(event, suffix) {
	const s3Key = event.location.key;
	const extension = path.extname(s3Key);
	return `/tmp/${md5(s3Key)}${suffix}${extension}`;
}

function md5(input) {
	return crypto.createHash('md5').update(input).digest("hex");
}

function createThumbnail(options) {
	return new Promise((resolve, reject) => {
		gm(options.inputPath)
			.resize(options.width, options.height)
			.write(options.outputPath, function (err) {
				if(err) return reject(err);
				return resolve(options.outputPath);
			});
	})
}