import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SocialFeed() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/diary", { replace: true });
  }, [navigate]);
  return null;
}
