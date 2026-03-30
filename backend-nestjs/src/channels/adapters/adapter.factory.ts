import { ChannelAdapter } from './channel-adapter.interface';
import { ZaloOAAdapter, ZaloOACredentials } from './zalo-oa.adapter';
import { FacebookAdapter, FacebookCredentials } from './facebook.adapter';

/**
 * Creates a ChannelAdapter from channel type and decrypted credentials JSON.
 * Matches Go's channels.NewAdapter().
 */
export function createAdapter(
  channelType: string,
  credentialsJson: string,
): ChannelAdapter {
  switch (channelType) {
    case 'zalo_oa': {
      let creds: ZaloOACredentials;
      try {
        creds = JSON.parse(credentialsJson);
      } catch {
        throw new Error('invalid zalo_oa credentials: invalid JSON');
      }
      return new ZaloOAAdapter(creds);
    }
    case 'facebook': {
      let creds: FacebookCredentials;
      try {
        creds = JSON.parse(credentialsJson);
      } catch {
        throw new Error('invalid facebook credentials: invalid JSON');
      }
      return new FacebookAdapter(creds);
    }
    default:
      throw new Error(`unsupported channel type: ${channelType}`);
  }
}
