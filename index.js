const { Contract } = require("fabric-contract-api");
const crypto = require("crypto");

class KVContract extends Contract {
  constructor() {
    super("KVContract");
  }

  async instantiate() {
    // function that will be invoked on chaincode instantiation
  }

  async put(ctx, key, value) {
    await ctx.stub.putState(key, Buffer.from(value));
    return { success: "ok" };
  } // for testing the ledger 

  async get(ctx, key) {
    const buffer = await ctx.stub.getState(key);
    if (!buffer || !buffer.length) return { error: "NOT_FOUND" };
    let buffer_object = JSON.parse(buffer.toString()) ;
    buffer_object["success"] = "OK" ; 
    console.log(buffer_object) ; 
    return buffer_object;
  } // for testing the ledger 
  
  async create_patient_instance(ctx, patient_id, pointer_object, hash_object) {
    // key : { patient }
    // value : { ACL, pointer of EHR, hash value of EHR data }
    // pointer_object and hash_object need to be prepare when upload
    // For the reason of blockchain performance, data processing of key and value will
    // be done at front-end

    const rule = {
      resource1 : 1,
      resource2 : 2,
      resource3 : 3,
      resource4 : 4,
      resource5 : 5
    } ;

    pointer_object = JSON.parse(pointer_object) ;
    hash_object = JSON.parse(hash_object) ;
    let value = {
      acl : rule,               // object    resource->level
      pointer : pointer_object, // object    hospital_did->pointer
      hash : hash_object        // object    hospital_did->hash
    } ;
    await ctx.stub.putState(patient_id, Buffer.from(JSON.stringify(value)));
    return { success: "OK", DataOwner: patient_id}
  } // create_patient_instance

  async update_instance(ctx, patient_id, hospital_id, _pointer, _hash) {
    const buffer = await ctx.stub.getState(patient_id);
    if (!buffer || !buffer.length) return { error: "(update_instance)NOT_FOUND" };
    let buffer_object = JSON.parse(buffer.toString()) ;
    buffer_object["pointer"][hospital_id] = _pointer ; // append EHR pointer
    buffer_object["hash"][hospital_id] = _hash ; // append hash value
    await ctx.stub.putState(patient_id, Buffer.from(JSON.stringify(buffer_object))) ;
    return { updata_instance : "success!" } ; 
  } // update_instance()

  async update_hash(ctx, patient_id, hospital_id, new_hash) {
    const buffer = await ctx.stub.getState(patient_id);
    if (!buffer || !buffer.length) return { error: "(update_hash)NOT_FOUND" };
    let buffer_object = JSON.parse(buffer.toString()) ;
    buffer_object["hash"][hospital_id] = new_hash ;
    await ctx.stub.putState(patient_id, Buffer.from(JSON.stringify(buffer_object)));
    return { updata_hash : "success!" } ; 
  } // update_hash()

  async revoke_access(ctx, patient_id, resource_type, degree) {
    const buffer = await ctx.stub.getState(patient_id);
    if (!buffer || !buffer.length) return { error: "(revoke_access)NOT_FOUND" };
    let buffer_object = JSON.parse(buffer.toString()) ;
    let keys_array = Object.keys(buffer_object["acl"]) ;
    let key = keys_array.find((e) => e == resource_type) ;
    if ( !key )
      return { error: "(revoke_access)Resource NOT_FOUND" } ;
    let tmp = buffer_object["acl"][key] - degree ;
    if ( tmp <= 0 )
      return { error: "(revoke_access)Resource level OUT_OF_RANGE" } ;
    buffer_object["acl"][key] = tmp ;
    await ctx.stub.putState(patient_id, Buffer.from(JSON.stringify(buffer_object)));
    return { revoke_access : "success!" } ; 
  } // revoke_access() 

  async validate_hash(ctx, patient_id, hash_obj) {
    const buffer = await ctx.stub.getState(patient_id);
    let result = [] ;
    if (!buffer || !buffer.length) return { error: "(validate_hash)NOT_FOUND" };
    let buffer_object = JSON.parse(buffer.toString()) ;
    hash_obj = JSON.parse(hash_obj) ;
    let hash_key_array = Object.keys(buffer_object["hash"]) ; // 取出目前帳本上有紀錄的hospital did
    for ( let i = 0 ; i < hash_key_array.length ; i++ ) { // 與擁有的hash進行比對 若發現hash未更新或是為擁有此hash則進行註記
      let hospital_id = hash_key_array[i] ;
      if ( hash_obj.hasOwnProperty(hospital_id) ) {
        if ( hash_obj[hospital_id] != buffer_object["hash"][hospital_id] ) // 表示需要更新hash值
           result.push(hospital_id) ;
      } // if
      else 
        result.push(hospital_id) ; 
    } // for 
    
    return result ; // return the hospital did which need to be update
    
  } // validate_hash()

  async putPrivateMessage(ctx, collection) {
    const transient = ctx.stub.getTransient();
    const message = transient.get("message");
    await ctx.stub.putPrivateData(collection, "message", message);
    return { success: "OK" };
  }

  async getPrivateMessage(ctx, collection) {
    const message = await ctx.stub.getPrivateData(collection, "message");
    const messageString = message.toBuffer ? message.toBuffer().toString() : message.toString();
    return { success: messageString };
  }

  async verifyPrivateMessage(ctx, collection) {
    const transient = ctx.stub.getTransient();
    const message = transient.get("message");
    const messageString = message.toBuffer ? message.toBuffer().toString() : message.toString();
    const currentHash = crypto.createHash("sha256").update(messageString).digest("hex");
    const privateDataHash = (await ctx.stub.getPrivateDataHash(collection, "message")).toString("hex");
    if (privateDataHash !== currentHash) {
      return { error: "VERIFICATION_FAILED" };
    }
    return { success: "OK" };
  }
}

exports.contracts = [KVContract];
