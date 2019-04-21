import sys
import json

spotify_client_id = sys.argv[1]
spotify_client_secret = sys.argv[2]

with open("spotify_api.json", 'w') as outfile:
    outfile.write(json.dumps({
        "client_id": spotify_client_id,
        "client_secret": spotify_client_secret
    }, indent=4))