interface DatabaseRequest {
    userId? : string;
    username?: string;
    password?: string;
}

/**
   * Makes POST request to create an anonymous User. Response has the clientId for the user created.
   */
async function createAno(){
    const response = await fetch("http://localhost:8080/database/newano", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
          }
    });
    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("anoResult")!.innerText = `New User added: ${data.id}`;
    }else{
        document.getElementById("anoResult")!.innerText = `There was an error: ${data.error}`;
    }
}

/**
   * Makes POST request to create an User. 
   * @param username
   * @param password
   */
async function createUser(event: any){
    event.preventDefault();

    const userData: DatabaseRequest = {
        username: await (document.getElementById("queryUsername") as HTMLInputElement).value.trim(),
        password: await (document.getElementById("queryPassword") as HTMLInputElement).value.trim(),    
    }

    const response = await fetch("http://localhost:8080/database/newuser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify(userData),
    });
    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("userResult")!.innerText = `New User created: ${data.id} \n Username ${data.userData}`;
    }else{
        document.getElementById("userResult")!.innerText = `There was an error: ${data.error}`;
    }
}


async function createChat(){

    const input = (document.getElementById("chatUserList") as HTMLInputElement).value;
    const userIdForm = input.split(',').map(id => id.trim()).filter(id => id !== '');
    const userList: DatabaseRequest[] = userIdForm.map(id => ({ userId: id }));


    const response = await fetch("http://localhost:8080/database/newchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(userList),
    });
    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("chatResult")!.innerText = `New Chat created: ${data.id} \n Users: ${userIdForm.join(', ')}`;
    }else{
        console.log(data);
        document.getElementById("chatResult")!.innerText = `There was an error: ${data.error}`;
    }
}

async function getChat(event: any){
    event.preventDefault();

    const params: string[] = [];
    const chatId: string = "61a015ae-d8a3-4f5a-a8b5-6df1bcbaf11f";
    if (chatId) {
      params.push(`chatid=${chatId}`);
    }

    const queryString = params.length > 0 ? "?" + params.join("&") : "";

    const url = `http://localhost:8080/database/getchat${queryString}`;


    const response = await fetch(url);


    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("getChat")!.innerText = `Chat: ${JSON.stringify(data.userData)}`;
    }else{
        document.getElementById("getChat")!.innerText = `There was an error: ${data.error}`;
    }
}

function DatabaseTest() {
    return (
    <>  
    <div className="w-full h-auto p-7 mt-5 bg-red-500">
        <h2 className="text-3xl">Database</h2>
        <div className="mt-5"><button onClick={createAno}>Create Anonymous User</button></div>
        <div id="anoResult"></div>
        <div className="mt-5">
            <label htmlFor="queryUsername">Username:</label>  <br></br>
            <input className="bg-white border-black border-2 mb-4 text-black" id="queryUsername" />
            <br></br>
            <label htmlFor="queryPassword">Password:</label> <br></br>
            <input className="bg-white border-black border-2 mb-4 text-black" id="queryPassword" type="password"/>
            <br></br>
            <button onClick={createUser}> Create new user</button>
        </div>
        <div id="userResult"></div>
        <label htmlFor="chatUserList">User:</label>  <br></br>
        <input className="bg-white border-black border-2 mb-4 text-black" id="chatUserList" />
        <div className="mt-5"><button onClick={createChat}>Create Chat</button></div>
        <div id="chatResult"></div>
        <div className="mt-5"><button onClick={getChat}>Get Chat</button></div>
        <div id="getChat"></div>
    </div>
    </>
)
}export default DatabaseTest