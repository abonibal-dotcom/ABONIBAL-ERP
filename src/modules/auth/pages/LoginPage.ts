import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import type { Router } from "../../../core/Router";
import type { AuthState } from "../AuthState";
import type { AuthStateService, AuthStateUnsubscribe } from "../AuthStateService";
import { AuthConfigurationUnavailableError, getAuthStateService } from "../AuthRuntime";

export class LoginPage extends Page {

    private readonly authStateService: AuthStateService;

    private form: HTMLFormElement | null = null;

    private emailInput: HTMLInputElement | null = null;

    private passwordInput: HTMLInputElement | null = null;

    private submitButton: HTMLButtonElement | null = null;

    private logoutButton: HTMLButtonElement | null = null;

    private messageElement: HTMLElement | null = null;

    private sessionSummaryElement: HTMLElement | null = null;

    private authenticatedPanel: HTMLElement | null = null;

    private unsubscribe: AuthStateUnsubscribe | null = null;

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        void this.signIn();

    };

    private readonly handleLogout = (): void => {

        void this.signOut();

    };

    public constructor() {

        super();

        this.authStateService = getAuthStateService();

    }

    public title(): string {

        return "تسجيل الدخول";

    }

    public render(): string {

        return `
            <section id="login-page" data-auth-status="unauthenticated">

                <h1>تسجيل الدخول</h1>

                <p id="login-message" role="status"></p>

                <form id="login-form" autocomplete="off">

                    <div class="form-group">

                        <label for="login-email">البريد الإلكتروني</label>

                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            autocomplete="username"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="login-password">كلمة المرور</label>

                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            autocomplete="current-password"
                            required
                        >

                    </div>

                    <button id="login-submit" type="submit">
                        تسجيل الدخول
                    </button>

                </form>

                <section id="authenticated-panel" class="hidden">

                    <p id="auth-session-summary"></p>

                    <button id="logout-button" type="button">
                        تسجيل الخروج
                    </button>

                </section>

            </section>
        `;

    }

    public onEnter(): void {

        this.onLeave();

        this.form = document.getElementById("login-form") as HTMLFormElement | null;
        this.emailInput = document.getElementById("login-email") as HTMLInputElement | null;
        this.passwordInput = document.getElementById("login-password") as HTMLInputElement | null;
        this.submitButton = document.getElementById("login-submit") as HTMLButtonElement | null;
        this.logoutButton = document.getElementById("logout-button") as HTMLButtonElement | null;
        this.messageElement = document.getElementById("login-message");
        this.sessionSummaryElement = document.getElementById("auth-session-summary");
        this.authenticatedPanel = document.getElementById("authenticated-panel");

        this.form?.addEventListener("submit", this.handleSubmit);

        this.logoutButton?.addEventListener("click", this.handleLogout);

        this.unsubscribe = this.authStateService.subscribe(this.renderAuthState);

        this.renderAuthState(this.authStateService.getState());

    }

    public onLeave(): void {

        this.form?.removeEventListener("submit", this.handleSubmit);

        this.logoutButton?.removeEventListener("click", this.handleLogout);

        this.unsubscribe?.();

        this.unsubscribe = null;

        this.form = null;

        this.emailInput = null;

        this.passwordInput = null;

        this.submitButton = null;

        this.logoutButton = null;

        this.messageElement = null;

        this.sessionSummaryElement = null;

        this.authenticatedPanel = null;

    }

    private readonly renderAuthState = (state: AuthState): void => {

        const pageElement = document.getElementById("login-page");

        if (pageElement) {

            pageElement.dataset.authStatus = state.status;

        }

        if (state.status === "authenticated") {

            this.form?.classList.add("hidden");

            this.authenticatedPanel?.classList.remove("hidden");

            if (this.sessionSummaryElement) {

                this.sessionSummaryElement.textContent = `تم تسجيل الدخول باسم ${state.session.user.displayName} (${state.session.account.name}).`;

            }

            return;

        }

        this.authenticatedPanel?.classList.add("hidden");

        this.form?.classList.remove("hidden");

        if (this.sessionSummaryElement) {

            this.sessionSummaryElement.textContent = "";

        }

    };

    private async signIn(): Promise<void> {

        const email = this.emailInput?.value.trim() ?? "";
        const password = this.passwordInput?.value ?? "";

        if (!email || !password) {

            this.setMessage("أدخل البريد الإلكتروني وكلمة المرور.");

            return;

        }

        this.setBusy(true);
        this.setMessage("Signing in...");

        try {

            await this.authStateService.signIn({ email, password });

            if (this.passwordInput) {

                this.passwordInput.value = "";

            }

            this.setMessage("Signed in.");

            void Container.get<Router>("router").navigate("dashboard");

        } catch (error) {

            this.setMessage(toSafeSignInMessage(error));

        } finally {

            this.setBusy(false);

        }

    }

    private async signOut(): Promise<void> {

        this.setBusy(true);
        this.setMessage("Signing out...");

        try {

            await this.authStateService.signOut();

            this.setMessage("تم تسجيل الخروج.");

        } catch {

            this.setMessage("Sign out failed. Try again.");

        } finally {

            this.setBusy(false);

        }

    }

    private setBusy(isBusy: boolean): void {

        if (this.submitButton) {

            this.submitButton.disabled = isBusy;

        }

        if (this.logoutButton) {

            this.logoutButton.disabled = isBusy;

        }

    }

    private setMessage(message: string): void {

        if (this.messageElement) {

            this.messageElement.textContent = message;

        }

    }

}

function toSafeSignInMessage(error: unknown): string {

    if (error instanceof AuthConfigurationUnavailableError) {

        return "تسجيل الدخول غير مهيأ لهذه البيئة.";

    }

    if (error instanceof Error && error.message.includes("AuthSession could not be resolved")) {

        return "This account is not configured for ABONIBAL ERP.";

    }

    return "فشل تسجيل الدخول. تحقق من بيانات الدخول أو تواصل مع المسؤول.";

}
