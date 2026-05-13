import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Leaderboard() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/diary", { replace: true });
  }, [navigate]);
  return null;
}
