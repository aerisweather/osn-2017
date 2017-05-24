const moment = require('moment');
const request = require('request');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const lambda = new AWS.Lambda();

exports.handler = async (event, context, callback) => {
	try {
		console.log(`Received event: ${JSON.stringify(event)}`);
		// Figure out AMP endpoint, from event payload
		const endpoint = [
			`/${process.env.CLIENT_ID}_${process.env.CLIENT_SECRET}`,
			`/${event.payload.layers.join(',')}`,
			`/${event.payload.width}x${event.payload.height}`,
			`/${event.payload.center},${event.payload.zoom}`,
			`/${moment(event.payload.validTime).format('YYMMDDHHmmss')}`,
			`.png`
		].join('');

		// Read the image from AMP
		const readStream = request(`http://maps.aerisapi.com/${endpoint}`);

		// And write the image back up to S3
		const s3Location = {
			bucket: 'aeris-osn-2017',
			key: `amp-image-fetcher${endpoint}`
		};
		await s3.upload({
			Bucket: s3Location.bucket,
			Key: s3Location.key,
			Body: readStream
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessages = [{
			type: 'did-fetch-image',
			payload: {
				imageId: event.payload.imageId,
				validTime: event.payload.validTime,
				location: s3Location
			}
		}];
		await lambda.invoke({
			FunctionName: 'mediator',
			InvocationType: 'Event',
			Payload: outMessages
		}).promise();

		callback();
	}
	catch (err) {
		callback(err);
	}
};