import { parseArgs } from 'util';
import { LobbyApplicationService } from './app/LobbyApplicationService';
import { SocketGateway } from './app/SocketGateway';

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		port: {
			type: 'string',
			short: 'p'
		}
	},
	strict: false
});

const portStr = values.port as string | undefined ?? process.env['PORT'];

if (!portStr) {
	console.error('Error: Multiplayer server port must be supplied via --port <number> or PORT environment variable.');
	process.exit(1);
}

const port = Number.parseInt(portStr);
const gateway = new SocketGateway();
const application = new LobbyApplicationService(gateway);
gateway.setApplication(application);
gateway.listen(port).then(() => {
	console.log(`Magocracy multiplayer server listening on :${port}`);
});
