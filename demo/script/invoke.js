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
const crypto = require('crypto');
const readline = require('readline');
const execSync = require('child_process').execSync;
AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const lambda = new AWS.Lambda();
const [_bin, _path, workerName, relMsgFile] = process.argv;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const msgFile = path.resolve(process.cwd(), relMsgFile);
const msgMd5 = crypto.createHash('md5').update(msgFile).digest("hex");
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
				const location = `https://s3.amazonaws.com/${msg.location.Bucket}/${msg.location.Key}`;
				console.log(`\nLocation URL:`);
				console.log(location);

				rl.question('Open the previous link? [y] ', (answer) => {
					if(answer === '' || answer.toLowerCase() === 'y') {
						execSync(`bash -c "wget ${location} --quiet -O /tmp/${msgMd5} && xdg-open /tmp/${msgMd5}"`);
					}
					process.exit(0);
				});
			}

		},
		err => {
			console.error(`Message failed: ${err}`);
			process.exit(1);
		}
	);