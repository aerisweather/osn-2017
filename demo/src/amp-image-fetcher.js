const moment = require('moment');
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
 *	 validTime: Date; // ISO format
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
			`/${moment(message.validTime).format('YYYYMMDDHHmmss')}`,
			`.png`
		].join('');

		// Download the image from AMP
		const image = await request(`http://maps.aerisapi.com/${endpoint}`, {
			encoding: null
		});

		// And upload the image back up to S3
		const uploadLocation = {
			Bucket: 'aeris-osn-2017',
			Key: `amp-image-fetcher${endpoint}`
		};
		await s3.upload({
			Bucket: uploadLocation.Bucket,
			Key: uploadLocation.Key,
			Body: image
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessages = [{
			type: 'did-fetch-image',
			dateCreated: Date.now(),
			imageId: message.imageId,
			validTime: message.validTime,
			location: uploadLocation
		}];
		await lambda.invoke({
			FunctionName: 'osn2017-mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessages)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);

		callback();
	}
	catch (err) {
		console.error(err);
		callback(err);
	}
};