import { GroupDashboardBootstrap } from "@/components/group-dashboard-bootstrap";

interface GroupPageProps {
  params: { groupName: string };
}

export default function GroupPage({ params }: GroupPageProps) {
  const decodedGroupName = decodeURIComponent(params.groupName);

  return (
    <div className="py-8 md:py-16">
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-3 sm:gap-8 sm:px-6 lg:px-12">
        <GroupDashboardBootstrap groupName={decodedGroupName} />
      </main>
    </div>
  );
}

export function meta({ params }: GroupPageProps) {
  const decodedGroupName = decodeURIComponent(params.groupName);
  return [
    { title: `${decodedGroupName} - 模型健康面板` },
    { description: `查看 ${decodedGroupName} 分组下的模型健康状态` },
  ];
}
