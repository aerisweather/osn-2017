const AWS = require('aws-sdk');
const DynamoDbDataFlow = require("./DynamoDbDataFlow");

AWS.config.loadFromPath(`${__dirname}/../../deploy-credentials.ignore.json`);

(async () => {
	const client = new DynamoDbDataFlow({TableName: 'osn2017-aeris'});

	// Create a bunch of messages
	const messages = [
		{
			type:        'please-create-thumbnail',
			dateCreated: 200,
			target:      'thumbnail-creator',
			// Payload
			imageId:     'radar-mn',
			validTime:   new Date(600).getTime(),
			width:       100,
			height:      100,
			location: {
				Bucket: 'aeris-osn2017',
				Key: 'image-ingestor/radar-mn/6'
			}
		},
		/*{
			type:        'please-create-thumbnail',
			dateCreated: new Date(1005).getTime(),
			target:      'thumbnail-creator',
			// Payload
			imageId:     'satellite-ca',
			validTime:   new Date(600).getTime(),
			width:       100,
			height:      100,
			location:    's3://aeris-osn2017/image-ingestor/satellite-ca/6'
		},
		{
			type:        'did-create-thumbnail',
			dateCreated: new Date(1500).getTime(),
			target:      'thumbnail-creator',
			// Payload
			imageId:     'radar-mn',
			validTime:   new Date(600).getTime(),
			width:       100,
			height:      100,
			location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/6'
		},
		{
			type:        'did-create-thumbnail',
			dateCreated: new Date(1505).getTime(),
			target:      'thumbnail-creator',
			// Payload
			imageId:     'satellite-ca',
			validTime:   new Date(600).getTime(),
			width:       100,
			height:      100,
			location:    's3://aeris-osn2017/thumbnail-creator/satellite-ca/6'
		},
		{
			type:        'did-create-thumbnail',
			dateCreated: new Date(2500).getTime(),
			target:      'thumbnail-creator',
			// Payload
			imageId:     'radar-mn',
			validTime:   new Date(700).getTime(),
			width:       100,
			height:      100,
			location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/7'
		},
		{
			type:        'did-create-thumbnail',
			dateCreated: new Date(3500).getTime(),
			target:      'thumbnail-creator',
			// Payload
			imageId:     'radar-mn',
			validTime:   new Date(800).getTime(),
			width:       100,
			height:      100,
			location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/8'
		}*/
	];


	// Save the messages to the db
	await Promise.all(messages.map(msg => client.save(msg)));
	process.exit(0);

	const singleResult = await client.findLatestValidTime({
		type:    'did-create-thumbnail',
		imageId: 'radar-mn',
	});
	console.log(JSON.stringify(singleResult, null, 2));

	// Look for a message
	const results = await client.findByValidTime({
		type:         'did-create-thumbnail',
		imageId:      'radar-mn',
		minValidTime: 600
	});

	// Log the msg
	console.log(JSON.stringify(results, null, 2));
})()
	.then(
		() => {
			process.exit(0);
		},
		err => {
			console.error(err.stack);
			process.exit(1);
		}
	);

/*
 const primaryKey = message.type + message.dateCreated.getTime();


 // Also maintain a set for our search
 const querySet = message.type + message.payload.imageId;
 const queryScore = message.payload.validTime;
 const queryValue = primaryKey;*/

