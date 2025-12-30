import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "@src/shared/api";
import { useLanguage } from "@src/app/providers/useLanguage";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import { fetchProfile } from "@src/entities/user/model/slice";
import { selectProfile } from "@src/entities/user/model/selectors";
import { RollingSquareLoader } from "@src/shared/ui/loader/RollingSquareLoader";
import "./EmailVerifyPage.css";
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

type VerifyStatus = "loading" | "success" | "error";

export function EmailVerifyPage() {
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectProfile);

    const [status, setStatus] = useState<VerifyStatus>("loading");
    const [message, setMessage] = useState<string>("");

    useEffect(() => {
        const token = searchParams.get("token");
        if (!token) {
            setStatus("error");
            setMessage(t("verifyEmail.errorMessage", { defaultValue: "Некорректный токен подтверждения" }));
            return;
        }

        const verify = async () => {
            try {
                setStatus("loading");
                const result = await authApi.verifyEmail(token);
                setStatus("success");
                setMessage(result?.message || t("verifyEmail.successMessage", { defaultValue: "Email успешно подтверждён!" }));

                if (localStorage.getItem("token") && !user?.email_verified) {
                    dispatch(fetchProfile()).catch(() => undefined);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "";
                setStatus("error");

                let translated = errorMessage || t("verifyEmail.errorMessage", { defaultValue: "Ошибка подтверждения email" });

                if (errorMessage.toLowerCase().includes("истек")) {
                    translated = t("verifyEmail.tokenExpired", { defaultValue: "Ссылка для подтверждения истекла. Запросите новую в профиле." });
                } else if (errorMessage.toLowerCase().includes("не найден")) {
                    translated = t("verifyEmail.userNotFound", { defaultValue: "Пользователь не найден" });
                }

                setMessage(translated);
            }
        };

        void verify();
    }, [dispatch, searchParams, t, user?.email_verified]);

    return (
        <MobileMenuProvider>
            <SidebarProvider>
                <div className="wrapper-body">
                    <TradingHeader />
                    <div className="app-layout-wrapper">
                        <Sidebar />
                        <div className="page-content">
                            <div className="email-verify-page">
                                <div className="email-verify-card">
                                    <h1>{t("verifyEmail.title", { defaultValue: "Подтверждение email" })}</h1>
                                    <p className="email-verify-description">
                                        {status === "loading"
                                            ? t("verifyEmail.descriptionLoading", { defaultValue: "Проверяем данные. Пожалуйста, подождите…" })
                                            : message || t("verifyEmail.description", { defaultValue: "Завершите подтверждение email, чтобы продолжить работу с платформой." })
                                        }
                                    </p>

                                    <div className={`email-verify-status email-verify-status--${status}`}>
                                        {status === "loading" && <RollingSquareLoader size="small" />}
                                        <span>
                                            {status === "success"
                                                ? t("verifyEmail.successMessage", { defaultValue: "Email успешно подтверждён!" })
                                                : status === "error"
                                                    ? message
                                                    : t("verifyEmail.descriptionLoading", { defaultValue: "Проверяем данные. Пожалуйста, подождите…" })
                                            }
                                        </span>
                                    </div>

                                    <div className="email-verify-actions">
                                        <Link to={user ? "/profile" : "/trading"} className="email-verify-btn">
                                            {t("verifyEmail.backToProfile", { defaultValue: user ? "Вернуться в профиль" : "Перейти к торговле" })}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Header />
                </div>
            </SidebarProvider>
        </MobileMenuProvider>
    );
}

export default EmailVerifyPage;

