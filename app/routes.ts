import {
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("group/:groupName", "routes/group.$groupName.tsx"),
  route("login", "routes/login.tsx"),
  // Admin UI — session-guarded via the dashboard layout loader.
  layout("routes/dashboard.tsx", [
    route("dashboard", "routes/dashboard._index.tsx"),
    route("dashboard/configs", "routes/dashboard.configs.tsx"),
    route("dashboard/configs/new", "routes/dashboard.configs_.new.tsx"),
    route("dashboard/configs/:id", "routes/dashboard.configs_.$id.tsx"),
    route("dashboard/models", "routes/dashboard.models.tsx"),
    route("dashboard/models/new", "routes/dashboard.models_.new.tsx"),
    route("dashboard/models/:id", "routes/dashboard.models_.$id.tsx"),
    route("dashboard/templates", "routes/dashboard.templates.tsx"),
    route("dashboard/templates/new", "routes/dashboard.templates_.new.tsx"),
    route("dashboard/templates/:id", "routes/dashboard.templates_.$id.tsx"),
    route("dashboard/groups", "routes/dashboard.groups.tsx"),
    route("dashboard/groups/new", "routes/dashboard.groups_.new.tsx"),
    route("dashboard/groups/:id", "routes/dashboard.groups_.$id.tsx"),
    route("dashboard/history", "routes/dashboard.history.tsx"),
    route("dashboard/notifications", "routes/dashboard.notifications.tsx"),
    route("dashboard/notifications/new", "routes/dashboard.notifications_.new.tsx"),
    route("dashboard/notifications/:id", "routes/dashboard.notifications_.$id.tsx"),
    route("dashboard/users", "routes/dashboard.users.tsx"),
    route("dashboard/system", "routes/dashboard.system.tsx"),
  ]),
];
