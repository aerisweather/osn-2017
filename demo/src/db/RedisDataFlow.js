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
		await this.redisClient
			.zadd(
				// Key by type + imageId
				`${message.type}:${message.imageId}`,
				// Sort by validTime
				message.validTime || 0,
				// Save the message as JSON
				JSON.stringify(message)
			);
	}

	async findLatestValidTime({type, imageId}) {
		return this.findByValidTime({
			type,
			imageId,
			limit: 1
		})[0];
	}

	async findByValidTime({type, imageId, minValidTime, maxValidTime, limit = 99}) {
		const results = await this.redisClient
			.zrevrangebyscore(
				// Records are keyed by type/imageId
				`${type}:${imageId}`,
				// Find values between min/max valid time
				maxValidTime || '+inf', minValidTime || '-inf',
				'LIMIT', '0', limit
			);

		// parse the results
		return results
			// ignore keys, in results
			.filter(res => res.startsWith('{'))
			.map(msgJson => JSON.parse(msgJson))
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