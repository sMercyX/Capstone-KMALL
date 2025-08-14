import React from "react";
import { useAuth } from "../../auth/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const Dashboard: React.FC = () => {
  // const { user, token, logout } = useAuth();
  // const location = useLocation();

  // if (!user || !token) {
  //   return <Navigate to="/login" replace state={{ from: location }} />;
  // }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
      <h1>Dashboard</h1>
      {/* <p>ยินดีต้อนรับ, <b>{user?.name}</b> ({user?.email})</p>
      <button onClick={logout} style={{ marginTop: 12 }}>ออกจากระบบ</button> */}
    </div>
  );
};

export default Dashboard;
