/* Event Workflow */
[
	// Fetch image
	{
		type: 'please-fetch-image',
		dateCreated: Date(),
		payload: {
			imageId: 'severe',
			layers: ['flat-dk', 'alerts', 'radar', 'stormcells', 'admin-dk'],
			width: 800,
			height: 600,
			center: '55417',
			zoom: 7,
			validTime: new Date()
		}
	},
	{
		type: 'did-fetch-image',
		payload: {
			imageId: 'severe',
			validTime: new Date(),
			location: 's3://osn-demo/....'
		}
	},

	// Thumbnail
	// (for every image)
	{
		type: 'please-create-thumbnail',
		payload: {
			imageId: 'severe',
			validTime: new Date(),
			width: 100,
			height: 100,
			location: 's3://osn-demo/....'
		}
	},
	{
		type: 'did-create-thumbnail',
		payload: {
			imageId: 'severe',
			validTime: new Date(),
			location: '...'
		}
	},

	// GIF
	// (for every set of 5 validTimes that we get)
	{
		type: 'please-create-gif',
		payload: {
			imageId: 'severe',
			minValidTime: new Date(),
			maxValidTime: new Date(),
			locations: ['s3://osn-demo/....', 's3://osn-demo/....', 's3://osn-demo/....']
		}
	},
	{
		type: 'did-create-gif',
		imageId: 'severe',
		minValidTime: new Date(),
		maxValidTime: new Date(),
		location: 's3://osn-demo/....'
	},


	// Email
	// (whenever a gif is created)
	// or maybe we skip this, and just show that everything was uploaded to s3
	{
		type: 'please-send-email',
		payload: {
			to: 'demo@aerisweather.com',
			// Note -- we'll need to use SES to send HTML emails.
			body: `
				Check out this cool GIF we made: 
				<a href="${didCreateGif.location}">
					<img src="${thumbnailCorrespondingToTheGifMaxValidTime.location}">
				</a>
			`
		}
	}
];