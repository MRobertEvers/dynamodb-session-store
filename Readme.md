# DynamoDB-Session-Store

DynamoDB session store. Compatible with express. Used to create and log a session cookie with dynamodb.

## Features

- .touch function that updates the session expiration, so the lifetime of the session is always measured from the last user interaction.
- Does not create a table if it does not exist. This is by design.

## Usage

    const AWS = require('aws-sdk');
    var app = express();
    app.use(session(
        {
            secret: "my secret",
            resave: false,
            saveUninitialized: false,
            store: new DynamoDBStore({
                table: 'WebDev-Sessions',
                hashKey: 'Username',
                client: new AWS.DynamoDB(credentials)
            })
        }
    ));
    
## Notes

Implements express-session [session-store](https://www.npmjs.com/package/express-session#session-store-implementation) model. Function descriptions can be found there.