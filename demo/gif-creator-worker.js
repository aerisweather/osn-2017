const crypto = require('crypto');
const fs = require('fs');
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
	let imgPaths = [];

	function errorHandler(err) {
		// Make sure we cleanup our downloaded files if we have a problem.
		imgPaths.map(fs.unlinkSync);
		callback(err);
	}

	try {
		console.log(`Got event: `, event);
		const payload = event.payload;

		// We can't stream multiple files to make a gif, download it is.
		imgPaths = await Promise.all(
			event.payload.locations.map(downloadImage)
		);

		// Get conversion stream
		imgPaths.reduce((gifConverter, imgPath) => {
			gifConverter = gifConverter.in(imgPath);
			return gifConverter;
		}, gm());

		const gifStream = gifConverter
			.delay(100)
			.stream()
			.on('error', errorHandler);

		// Save back to S3
		const outputLocation = {
			bucket: S3_OUTPUT_BUCKET,
			key:    `${S3_OUTPUT_PREFIX}/${payload.imageId}/${uuid()}${path.basename(srcImageLocation.key)}`
		};
		await new Promise((resolve, reject) => {
			const s3Params = {
				Bucket: outputLocation.bucket,
				Key:    outputLocation.key,
				Body:   gifStream
			};
			console.log(`Sending to S3 ${JSON.stringify(outputLocation)} ...`);
			s3.upload(s3Params, function (err, metadata) {
				if (err) return reject(err);
				console.log("Done sending to S3.");
				return resolve(metadata);
			});
		});

		const resultMessage = {
			type:    'did-create-thumbnail',
			payload: {
				imageId:   event.payload.imageId,
				validTime: event.payload.imageId,
				location:  outputLocation
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
				if (err) return errorHandler(err);
				// Successfully sent result to the mediator!
				callback(resultMessage);
			});
	}
	catch (error) {
		errorHandler(error)
	}
};

async function downloadImage(srcLocation) {
	return new Promise((resolve, reject) => {

		// Get unique output path
		const outputPath = getTmpPath(srcLocation);

		console.log(`Downloading ${JSON.stringify(srcLocation)} ...`);
		const s3ReadStream = s3.getObject(srcLocation).createReadStream()
			.on('error', reject);

		const fileWriteStream = fs.createWriteStream(outputPath)
			.on('error', reject);

		// Start downloading - Stream from S3 -> Unique output path
		s3ReadStream.pipe(fileWriteStream)
			.on('finish', () => {
				console.log(`Done downloading ${JSON.stringify(srcLocation)} to ${outputPath}`);
				return resolve(outputPath);
			});
	});
}

/**
 * @param {{bucket: string, key:string}} location
 * @param {string} [suffix=""]
 * @return {string}
 */
function getTmpPath(location, suffix) {
	const s3Key = location.key;
	const extension = path.extname(s3Key);
	return `/tmp/${md5(s3Key)}${suffix}${extension}`;
}

function md5(input) {
	return crypto.createHash('md5').update(input).digest("hex");
}