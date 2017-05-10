const moment = require('moment');
const request = require('request');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

module.exports = async (event, context, callback) => {
	try {
		const endpoint = [
			`/${process.env.CLIENT_ID}_${process.env.CLIENT_SECRET}`,
			`/${event.payload.layers.join(',')}`,
			`/${event.payload.width}x${event.payload.height}`,
			`/${event.payload.center},${event.payload.zoom}`,
			`/${moment(event.payload.validTime).format('YYMMDDHHmmss')}`
		].join('');

		const readStream = request(`http://maps.aerisapi.com/${endpoint}`);

		const s3Bucket = 'aeris-osn-2017';
		const s3Key = `amp-image-fetcher${endpoint}`;
		await s3.upload({
			Bucket: s3Bucket,
			Key: s3Key,
			Body: readStream
		}).promise();

		const outMessage = [{
			type: 'did-fetch-image',
			payload: {
				imageId: event.payload.imageId,
				validTime: event.payload.validTime,
				location: {
					bucket: s3Bucket,
					key: s3Key
				}
			}
		}];
		// TODO: Send the outMessages

		callback();
	}
	catch (err) {
		callback(err);
	}
};