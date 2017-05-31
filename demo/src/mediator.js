const RedisDataFlow = require('./db/RedisDataFlow');

const redisDataFlow = new RedisDataFlow({
	host: process.env.REDIS_HOSTNAME,
	port: process.env.REDIS_PORT
});

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