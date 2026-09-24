import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";
import { SubscribeButton } from "@/components/SubscribeButton";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const subscribed = hasActiveSubscription(user);

  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow">
      <h1 className="mb-4 text-2xl font-bold text-orange-600">アカウント</h1>

      <div className="mb-6 flex flex-col gap-1 text-sm text-gray-700">
        <p>名前：{user.name ?? "未設定"}</p>
        <p>メールアドレス：{user.email}</p>
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <h2 className="font-bold text-orange-700">プラン</h2>
        {subscribed ? (
          <>
            <p className="mt-1 text-sm text-green-700">
              ✅ プレミアムプラン ご利用中
              {user.currentPeriodEnd &&
                `（次回更新日：${user.currentPeriodEnd.toLocaleDateString("ja-JP")}）`}
            </p>
            <SubscribeButton mode="manage" />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">
              現在は無料プランです。月額200円のプレミアムプランに登録すると、
              すべてのレベルが解放されます。
            </p>
            <SubscribeButton mode="subscribe" />
          </>
        )}
      </div>
    </div>
  );
}
