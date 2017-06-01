const AWS = require('aws-sdk');
AWS.config.loadFromPath(`${__dirname}/../deploy-credentials.ignore.json`);

const cw = new AWS.CloudWatchLogs();

cw.filterLogEvents({
	logGroupName: '/aws/lambda/osn2017-mediator',
	filterPattern: 'images since',
})
.promise()
.then(
	(res) => {
		const msgs = res.events.map(e => e.message);
		console.log(msgs.join('\n\n\n'));
		debugger;
	},
	err => console.error(err)
);