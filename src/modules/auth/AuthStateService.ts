import type { AuthProvider, SignInCredentials } from "./AuthProvider";
import type { AuthState } from "./AuthState";

export type AuthStateSubscriber = (state: AuthState) => void;

export type AuthStateUnsubscribe = () => void;

export class AuthStateService {

    private readonly authProvider: AuthProvider;

    private readonly subscribers = new Set<AuthStateSubscriber>();

    private state: AuthState = { status: "unauthenticated" };

    public constructor(authProvider: AuthProvider) {

        this.authProvider = authProvider;

    }

    public getState(): AuthState {

        return this.state;

    }

    public subscribe(subscriber: AuthStateSubscriber): AuthStateUnsubscribe {

        this.subscribers.add(subscriber);

        return () => {

            this.subscribers.delete(subscriber);

        };

    }

    public async initialize(): Promise<AuthState> {

        const previousState = this.state;

        this.setState({ status: "loading" });

        try {

            const session = await this.authProvider.getCurrentSession();

            const nextState: AuthState = session
                ? { status: "authenticated", session }
                : { status: "unauthenticated" };

            this.setState(nextState);

            return this.state;

        } catch (error) {

            this.setState(previousState);

            throw error;

        }

    }

    public async signIn(credentials: SignInCredentials): Promise<AuthState> {

        const session = await this.authProvider.signIn(credentials);

        this.setState({ status: "authenticated", session });

        return this.state;

    }

    public async signOut(): Promise<AuthState> {

        await this.authProvider.signOut();

        this.setState({ status: "unauthenticated" });

        return this.state;

    }

    private setState(state: AuthState): void {

        this.state = state;

        this.notifySubscribers(state);

    }

    private notifySubscribers(state: AuthState): void {

        for (const subscriber of this.subscribers) {

            try {

                subscriber(state);

            } catch {

                // Subscriber failures must not roll back or corrupt AuthState.

            }

        }

    }

}
