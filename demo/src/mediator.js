const RedisDataFlow = require('./db/RedisDataFlow');

exports.handler = async (event, context, callback) => {
	ctx.callbackWaitsForEmptyEventLoop = false;
	try {
		console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

		// Save event
	}
	catch(err) {
		console.error(err);
		callback(err);
	}
};