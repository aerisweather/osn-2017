/**
 * Delete all CloudWatch logs
 */
const AWS = require('aws-sdk');
AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const cw = new AWS.CloudWatchLogs();

const workers = [
	'amp-image-fetcher',
	'gif-creator',
	'mediator',
	'thumbnail-creator',
	'email-sender'
];

Promise.all(
	workers.map(
		w => cw.deleteLogGroup({
			logGroupName: `/aws/lambda/osn2017-${w}`
		}).promise()
			.catch(err => console.warn(`/aws/lambda/osn2017-${w}: ${err}`))
	)
)
	.then(() => process.exit());