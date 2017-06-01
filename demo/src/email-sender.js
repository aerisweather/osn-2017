const AWS = require('aws-sdk');
const ses = new AWS.SES();
const lambda = new AWS.Lambda();

/**
 * Payload
 * {
 * 	 to: string[];
 * 	 from: string;
 * 	 subject: string;
 * 	 body: string;
 * }
 */
exports.handler = async (message, context, callback) => {
	try {
		context.callbackWaitsForEmptyEventLoop = false;
		console.log(`Received event: ${JSON.stringify(message, null, 2)}`);

		await ses.sendEmail({
			Destination: {
				ToAddresses: message.to
			},
			Message: {
				Body: {
					Html: {
						Data: message.body
					}
				},
				Subject: {
					Data: message.subject
				}
			},
			Source: message.from
		}).promise();

		// Send a message to the mediator,
		// to let it know we're done
		const outMessage = {
			type: 'did-send-email',
			dateCreated: Date.now()
		};
		await lambda.invoke({
			FunctionName: 'osn2017-mediator',
			InvocationType: 'Event',
			Payload: JSON.stringify(outMessage)
		}).promise();
		console.log(`Completed with: ${JSON.stringify(outMessage, null, 2)}`);

		callback(null, outMessage);
	}
	catch (err) {
		console.error(err);
		callback(err);
	}
};