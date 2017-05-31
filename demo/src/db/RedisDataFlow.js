const Redis = require("ioredis");

class RedisDataFlow {

	constructor(opts) {
		// Redis setup
		this.redisClient = new Redis(opts);
		this.redisClient.on("error", function (err) {
			console.error("Redis error " + err);
		});

		// Bonus! We can define "stored procedures" (lua scripts) on the server to get things all at once
		// - This will find our ID in our custom "index" and grab it's entire object from the hash map stored at that key.
		/*this.redisClient.defineCommand('findLatest', {
			numberOfKeys: 1,
			lua: `return redis.call('HGETALL', unpack(redis.call('ZREVRANGEBYSCORE', KEYS[1], '+inf', '-inf', 'LIMIT', '0', '1')))`
		})*/
	}

	async save(message) {
		const pipeline = this.redisClient.pipeline();

		// Save the message to a hash map
		// keyed by message id (type + validTime)
		pipeline.hmset(getMessageId(message), message);

		// Save the message to a sorted set
		// Keyed by sortId (type + imageId)
		// and sorted by validTime
		// This will allow us to search by validTime, later
		pipeline.zadd(getSortId(message), message.validTime, getMessageId(message));

		return pipeline.exec();
	}

	async findLatest({type, imageId}) {
		// Find the message id for the latest validTime
		const [messageId] = await this.redisClient
			.zrevrangebyscore(getSortId({type, imageId}), '+inf', '-inf', 'LIMIT', '0', '1');

		if (!messageId) { return undefined; }

		// Lookup the message by messageId
		const message = await this.redisClient.hgetall(messageId);

		return message;

		// Bonus! We can use the "stored procedure" we defined earlier, and get all the data at once:
		/*return this.redisClient.findLatest(getSortId({type, imageId}))
		 	.then(transformArrayToObj)*/
	}

	async findSince({type, imageId}, minValidTime, limit = 99) {
		// Find the ids for all messages
		// since minValidTime
		const messageIds = await this.redisClient
			.zrevrangebyscore(getSortId({type, imageId}), '+inf', minValidTime, 'LIMIT', '0', limit);

		// Lookup the messages, by id
		const messages = await Promise.all(
			messageIds.map(
				msgId => this.redisClient.hgetall(msgId)
			)
		);

		return messages;
	}
}

function getMessageId(message) {
	return `${message.type}:${message.dateCreated}`;
}

function getSortId({type, imageId}) {
	return `${type}:${imageId}`;
}

function transformArrayToObj(arrResponse) {
	if (Array.isArray(arrResponse)) {
		let obj = {};
		for (let i = 0; i < arrResponse.length; i += 2) {
			obj[arrResponse[i]] = arrResponse[i + 1];
		}
		return obj;
	}
	return arrResponse;
}
module.exports = RedisDataFlow;