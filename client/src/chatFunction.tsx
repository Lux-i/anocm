interface DatabaseRequest {
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
async function createUser(){

    const userData: DatabaseRequest = {
        username: "Michael",
        password: "1234",    
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
        document.getElementById("userResult")!.innerText = `New User added: ${data.id} \n Username: ${data.userData}`;
    }else{
        document.getElementById("userResult")!.innerText = `There was an error: ${data.error}`;
    }
}

function DatabaseTest() {
    return (
    <>  
    <div className="w-full h-auto p-7 mt-5 bg-red-500">
        <h2 className="text-3xl">Database</h2>
        <div className="mt-5"><button onClick={createAno}>Create Anonymous User</button></div>
        <div id="anoResult"></div>
        <div className="mt-5"><button onClick={createUser}>Create User</button></div>
        <div id="userResult"></div>
    </div>
    </>
)
}export default DatabaseTest