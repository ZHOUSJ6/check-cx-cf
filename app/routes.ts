import { index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("group/:groupName", "routes/group.$groupName.tsx"),
];
