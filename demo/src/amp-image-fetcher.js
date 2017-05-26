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
exports.handler = async (event, context, callback) => {
	try {
		console.log(`Received event: ${JSON.stringify(event, null, 2)}`);
		// Figure out AMP endpoint, from event payload
		const endpoint = [
			`/${process.env.CLIENT_ID}_${process.env.CLIENT_SECRET}`,
			`/${event.layers.join(',')}`,
			`/${event.width}x${event.height}`,
			`/${event.center},${event.zoom}`,
			`/${moment(event.validTime).format('YYYYMMDDHHmmss')}`,
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
			imageId: event.imageId,
			validTime: event.validTime,
			location: uploadLocation
		}];
		await lambda.invoke({
			FunctionName: 'mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessages)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);

		callback();
	}
	catch (err) {
		callback(err);
	}
};