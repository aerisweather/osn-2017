

const db = {
  async save(msg) {
    await redis.zadd([
      // key (type + imageId)
      `${msg.type}:${msg.imageId}`,
      // score (dateCreated)
      message.dateCreated.getTime(),
      // value (message)
      JSON.stringify(msg)
    ]);
  },

  async findLatest({ type, imageId }) {
    const res = await redis.zrevrangebyscore([
      // key (type + imageId)
      `${type}:${imageId}`,
      // Include all results
      '-inf', 'inf',
      // with a limit of one
      'LIMIT', 1, 0
    ]);

    return JSON.parse(res[0]);
  },

  async findSince({ type, imageId }, sinceTime) {
    const res = await redis.zrevrangebyscore([
      // key (type + imageId)
      `${type}:${imageId}`,
      // Find since `sinceTime)
      sinceTime.getTime(), 'inf',
    ]);

    return res.map(r => JSON.parse(r));
  }

};