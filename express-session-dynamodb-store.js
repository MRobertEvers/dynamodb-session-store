const Store = require('express-session').Store;
const AWS = require('aws-sdk');

/*
* Export DynamoDBStore class
*/
module.exports = DynamoDBStore;

/**
 * This module implements a 'express-session' 'Store' class.
 * 
 * Usage...
 *   // This 'require' exposes a function that returns a middleware function.
 *   // i.e. session() returns a function(req, res, next) function.
 *   const session = require('express-session');
 * 
 *   const expressApp = express();
 * 
 *   // This requires cookieParser for maxAge
 *   expressApp.use(cookieParser());
 *   
 *   var sessionMiddleware = session({
 *      ...,
 *      store: new DynamoDBStore({
 *          table: 'Sessions',
 *          hashKey: 'SessionID',
 *          client: <ClientObject>
 *      })
 *   });
 *   expressApp.use(sessionMiddleware);
 */

// Key used to store the cookie in JSON format
const SESSION_KEY = 'Session';
const EXPIRES_KEY = 'Expires';

/**
 * Constructs a new DynamoDBStore object.
 * Compatible with session({store: <DynamoDBStore>})
 * Expects table to exist already!
 * 
 * TTL should be setup on the dynamoDB table for the 'expires' key if desired.
 * This is done in the dynamoDB console on AWS.
 * 
 * @param {Object} options (required)
 * 
 * options :=
 * {
 *   table: (string - required),
 *   hashKey: (string - required),
 *   client: (object - variable 1*) AWS.DynamoDB object,
 *   credentials: (object - variable 2*) 
 *                {
 *                   accessKeyId: (string - required)
 *                   secretAccessKey: (string - required)
 *                   region: (string - required)
 *                }
 * }
 */
function DynamoDBStore(options){
    this.table = options.table;
    this.hashKey = options.hashKey;

    if( options.client ){
        this.client = options.client;
    }
    else{
        this.client = new AWS.DynamoDB(options.credentials);
    }
}

/**
 * Inherit from Store.
 */
DynamoDBStore.prototype.__proto__ = Store.prototype;

/**
 * Adds the session to the database. Includes expiration time under 'Expires'
 * Stores the sessionID under the hashkey and stores the session in JSON format
 * under the SESSION Key
 * @param {String} sid Session Id
 * @param {Object} session Session Object
 * @param {Function} callback 
 */
DynamoDBStore.prototype.set = function(sid, session, callback){
    // Build the database item
    var expirationTime = this._getExpirationTime(session);

    var item = {};
    item[EXPIRES_KEY] = JSON.stringify(expirationTime);
    item[SESSION_KEY] = JSON.stringify(session);
    item[this.hashKey] = sid;

    // Append type values to each of the JSON entries
    var dynamoItem = MarshalObject(item, {
        Expires: 'N'
    });

    // Build the dynamoDB noSQL request
    var request = {
        TableName: this.table,
        Item: dynamoItem
    }
    this.client.putItem(request, callback)
}

/**
 * Searches for a session object stored in the database and Marshals it back
 * to an Object.
 * @param {String} sid Session ID
 * @param {Function} callback 
 */
DynamoDBStore.prototype.get = function(sid, callback){
    var KeyValue = {}
    KeyValue[this.hashKey] = { 'S': sid }

    this.client.getItem({
        TableName: this.table,
        Key: KeyValue,
        ConsistentRead: true
    }, function (err, result) {
        if (err) {
            callback(err);
        } 
        else {
            var now = Math.floor(Date.now() / 1000);

            if (!result.Item) {
                // No item found
                return callback(null, null);
            }
            else if (result.Item[EXPIRES_KEY] && now >= parseInt(result.Item[EXPIRES_KEY].N, 10)) {
                // Item found but expired
                callback(null, null);
            } 
            else {
                var session = result.Item[SESSION_KEY].S.toString();
                session = JSON.parse(session);
                callback(null, session);
            }
        }
    });
}

/**
 * Removes a session with the give sid from the databse
 * @param {String} sid Session ID
 * @param {Function} callback function(err)
 */
DynamoDBStore.prototype.destroy = function(sid, callback){
    if(!callback){
        callback = function(){};
    }

    var KeyValue = {};
    KeyValue[this.hashKey] = { S: sid };

    this.client.deleteItem({
        TableName: this.table,
        Key: KeyValue
    }, function(err, data){callback(err);});
}

/**
 * Updates the expiration field. When 'touch' is called, it pushes
 * the expirates time back equal to the amount the cookie can be old.
 * 
 * This is OPTION for the STORE interface.
 * @param {String} sid 
 * @param {Object} session 
 * @param {Function} callback 
 */
DynamoDBStore.prototype.touch = function(sid, session, callback){
    var expires = this._getExpirationTime(session);

    var params = {
        TableName: this.table,
        UpdateExpression: "set " + EXPIRES_KEY + " = :e",
        ExpressionAttributeValues:{
            ":e": {
              N:  JSON.stringify(expires)
            }
        },
        ReturnValues:"UPDATED_NEW"
    };
    params.Key = {};
    params.Key[this.hashKey] = { 'S': sid }

    if(!callback){
        callback = function(){};
    }

    this.client.updateItem(params, callback);
}

/**
 * Returns the desired expiration time based on what the cookie says.
 * The cookie is what the user has, so we need to expire the session
 * at the same time.
 * 
 * By default, express-session sets cookie.maxAge to null. It can be set when calling
 * session() like above... 
 * session({..., cookie{ maxAge: 100 }})
 * @param {Object} session Express-session Session object
 */
DynamoDBStore.prototype._getExpirationTime = function(session){
    // cookie.maxAge is in milliseconds
    var expirationTime = 0;
    var now = Date.now();
    if( session.cookie.maxAge ){
        expirationTime = now + session.cookie.maxAge;
    }
    else{
        // Default to 5 minutes
        expirationTime = now + 5 * 60 * 1000;
    }

    // DynamoDB stores time in seconds.
    return Math.floor(expirationTime / 1000);
}

/**
 * 
 * @param {object} userItem Object to Marshal
 * @param {object} types (optional) Object with corresponding keys as 'object'
 *                       whose values are the Marshalling type. e.g. Key: 'S' or Key: 'N'
 */
function MarshalObject(userItem, types){
    types = types || {};
    var result = {};
    for(var property in userItem){
        if(userItem.hasOwnProperty(property)){
            var value = {};
            if(types.hasOwnProperty(property)){
                value[types[property]] = userItem[property];
            }
            else{
                value['S'] = userItem[property];
            }
            result[property] = value;
        }
    }

    return result;
}