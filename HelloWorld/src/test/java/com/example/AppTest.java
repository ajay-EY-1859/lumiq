package com.example;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class AppTest {

    @Test
    void shouldReturnHelloWorldWhenNameIsBlank() {
        assertEquals("Hello, World!", new App().greet(""));
        assertEquals("Hello, World!", new App().greet("   "));
        assertEquals("Hello, World!", new App().greet(null));
    }

    @Test
    void shouldReturnPersonalizedGreeting() {
        assertEquals("Hello, Lumiq!", new App().greet("Lumiq"));
    }
}
