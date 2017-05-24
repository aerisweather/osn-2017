#!/usr/bin/env node
const AWS = require('aws-sdk');
AWS.config.loadFromPath(`${__dirname}/deploy-credentials.ignore.json`);

const lambda = new AWS.Lambda();
const [_bin, _path, fnName, msgFile] = process.argv;

lambda.invoke({
	FunctionName: fnName,
	InvocationType: 'Event',
	Payload: JSON.stringify(require(msgFile))
})
	.promise()
	.then(
		() => {
			console.log('Message sent');
			process.exit(0);
		},
		err => {
			console.error(`Message failed: ${err}`);
			process.exit(1);
		}
	);