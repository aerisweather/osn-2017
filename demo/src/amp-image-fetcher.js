const request = require('request-promise');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const lambda = new AWS.Lambda();

/**
 * Payload:
 * {
 * 	 imageId: string;
 * 	 layers: string[];
 * 	 width: number;
 * 	 height: number;
 * 	 center: string;
 * 	 zoom: number;
 *	 validTime: string; // Any valid time accepted by AMP
 * }
 */
exports.handler = async (message, context, callback) => {
	try {
		context.callbackWaitsForEmptyEventLoop = false;
		console.log(`Received event: ${JSON.stringify(message, null, 2)}`);

		// Figure out AMP endpoint, from event payload
		const endpoint = [
			`/${process.env.CLIENT_ID}_${process.env.CLIENT_SECRET}`,
			`/${message.layers.join(',')}`,
			`/${message.width}x${message.height}`,
			`/${message.center},${message.zoom}`,
			`/${message.validTime}`,
			`.png`
		].join('');

		// Download the image from AMP
		const res = await request(`http://maps.aerisapi.com/${endpoint}`, {
			encoding: null,
			resolveWithFullResponse: true
		});
		const image = res.body;

		// And upload the image back up to S3
		const uploadLocation = {
			Bucket: process.env.S3_BUCKET,
			Key: `amp-image-fetcher${endpoint}`
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: image,
			ACL: 'public-read'
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessage = {
			type: 'did-fetch-image',
			dateCreated: Date.now(),
			imageId: message.imageId,
			// Grab the valid time from the response headers
			validTime: new Date(res.headers['x-aeris-valid-date']).getTime(),
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
	catch (err) {
		console.error(err);
		callback(err);
	}
};