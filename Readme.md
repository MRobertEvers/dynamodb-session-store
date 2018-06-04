# DynamoDB-Session-Store

DynamoDB session store. Compatible with express. Used to create and log a session cookie with dynamodb.

## Features

- `touch` function that updates the session expiration, so the lifetime of the session is always measured from the last user interaction.
- Does not create a table if it does not exist. This is by design.
- Creates a dynamoDB record with the input hashKey, an `Expires` field, and a `Session` field.
- `Session` field contains JSON representation of the session object.
- Defaults the `Expires` field to 5 minutes from creation or last `touch`. This field indicates when it should be destroyed.

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
                hashKey: 'SessionID',
                client: new AWS.DynamoDB(credentials)
            })
        }
    ));
    
## Notes

Implements express-session [session-store](https://www.npmjs.com/package/express-session#session-store-implementation) model. Function descriptions can be found there.

### TTL and Session Expiration

DynamoDB features a built-in TTL feature. In order to clear expired sessions, you must enable TTL on the `Expires` field. See https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-how-to.html

### Setting Session Expiration Time

By default, this store sets the expiration time 5 minutes from creation or the last `touch`. This can be changed by setting the cookie.maxAge (in milliseconds) field for express-session. See here for some extra info [express-session](https://github.com/expressjs/session#cookiemaxage)

    app.use(session(
        {
            secret: "my secret",
            resave: false,
            saveUninitialized: false,
            store: new DynamoDBStore({
                table: 'WebDev-Sessions',
                hashKey: 'Username',
                client: dynamo.client
            }),
            
            // SET THE MAX AGE HERE
            cookie: { maxAge: 100 }
        }
    ));