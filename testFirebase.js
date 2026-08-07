import { database } from "./firebase.js";
import { ref, set } from "firebase/database";

set(ref(database, "test"), {
  message: "Firebase connected successfully"
})
.then(() => {
  console.log("Data written successfully");
})
.catch((error) => {
  console.log(error);
});