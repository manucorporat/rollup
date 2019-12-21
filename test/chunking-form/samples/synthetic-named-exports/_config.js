module.exports = {
	description: 'simple chunking',
	options: {
		input: ['main.js'],
		plugins: [
			{
				resolveId(id) {
					if (id === './dep1.js') {
						return {
							id,
							syntheticNamedExports: true
						};
					}
					return null;
				}
			}
		]
	}
};
