#!/usr/bin/env node
/**
 * Fetch `MSG_COUNT` images
 * using please-fetch-amp-image as a template
 */
const MSG_COUNT = 5;
const _ = require('lodash');
const AWS = require('aws-sdk');
AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const lambda = new AWS.Lambda();

const pleaseFetchAmpImage = require('../message/please-fetch-amp-image.json');

const msgs = _.range(0, MSG_COUNT)
	.map(n => Object.assign({}, pleaseFetchAmpImage, { validTime: `${n * -30}m` }));


Promise.all(
	msgs.map(
		msg => lambda.invoke({
			FunctionName: 'osn2017-amp-image-fetcher',
			InvocationType: 'RequestResponse',
			Payload: JSON.stringify(msg)
		}).promise()
			.then((res) => {
				const msg = JSON.parse(res.Payload);

				// Print out location URL
				console.log(`https://s3.amazonaws.com/${msg.location.Bucket}/${msg.location.Key}`)
			})
	)
)
	.then(
		() => {
			console.log('Messages sent');
			process.exit(0);
		},
		err => {
			console.error(`Messages failed: ${err}`);
			process.exit(1);
		}
	);