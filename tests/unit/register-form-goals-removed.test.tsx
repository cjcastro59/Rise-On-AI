import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
    }),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: {
            signInWithOtp: vi.fn(),
            verifyOtp: vi.fn(),
        },
        from: vi.fn(),
    }),
}));

vi.mock("react-google-recaptcha", () => ({
    default: () => <div data-testid="recaptcha" />,
}));

import { RegisterForm } from "@/components/auth/register-form";

describe("RegisterForm goals removal", () => {
    it("does not render the goals selection step or copy on the profile setup step", () => {
        render(<RegisterForm />);

        fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: "Jane" } });
        fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: "Doe" } });
        fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: "janedoe" } });
        fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: "jane@example.com" } });
        fireEvent.change(screen.getAllByPlaceholderText(/password/i)[0], { target: { value: "Password1!" } });
        fireEvent.change(screen.getByPlaceholderText(/confirm password/i), { target: { value: "Password1!" } });
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: /next/i }));
        expect(screen.queryByText(/select your goals/i)).not.toBeInTheDocument();
        expect(screen.getByText(/language preference/i)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /sex/i })).toBeInTheDocument();
    });
});
