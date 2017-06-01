#!/usr/bin/env node
/**
 * Directly invoke a lambda function.
 *
 * Usage:
 *
 * 	./script/invoke.js amp-image-fetcher ./message/please-fetch-amp-image.json
 */
const path = require('path');
const AWS = require('aws-sdk');
AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const lambda = new AWS.Lambda();
const [_bin, _path, workerName, relMsgFile] = process.argv;


const msgFile = path.resolve(process.cwd(), relMsgFile);
lambda.invoke({
	FunctionName: `osn2017-${workerName}`,
	InvocationType: 'RequestResponse',
	Payload: JSON.stringify(require(msgFile))
})
	.promise()
	.then(
		(res) => {
			const msg = JSON.parse(res.Payload);
			console.log(JSON.stringify(msg, null, 2));

			// Print out location URL
			if (msg.location) {
				console.log(`Location URL:`);
				console.log(`https://s3.amazonaws.com/${msg.location.Bucket}/${msg.location.Key}`)
			}

			process.exit(0);
		},
		err => {
			console.error(`Message failed: ${err}`);
			process.exit(1);
		}
	);