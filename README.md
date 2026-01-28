# Multipart RPC (mRPC)

mRPC is an implementation of RPC using HTTP multipart/formdata content. Making communications between client to server seamless with an option to have type annotations via JSDoc

Unfortunately the current implementation of mRPC middleware only supports the Go-like web framework built on top of Node's HTTP module.

### Update

Moved to using Bun and added some examples for connecting to database, auth, session, and event source / server-sent event setup
